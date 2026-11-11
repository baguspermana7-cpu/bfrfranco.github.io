/*
 * test-rz-pid-r120.mjs — R120 laws for the P&ID model, run by tools/test-rz-pid.mjs (not on its own).
 *
 * 1. PARITY, cross-sheet: off-page pairing on the reference fixture with the score derived by hand from build.py
 *    _opc_score; the reference's tests/test_real_world_cases.py ported case by case (one-to-one pairing, line number
 *    overriding a wrong flag + off_page_reference_mismatch, revision suffix, per-sheet tag scoping + tag_reused, same tag
 *    merging, duplicate tag on one sheet, part_of not unconnected); name_conflict; equipment scoping.
 * 2. PARITY, QA: RZPid.qa() returns every run_qa category of qa.py plus the build issues, sorted error -> info.
 * 3. BEYOND: trace / loopOf / impact on the CDU plant against hand-derived expectations.
 * 5. BEYOND: live() — at 100 % load every value equals balance(); monotonic in load; computed through CDU_ENGINE.
 * 6. Second plant (fuel day-tank transfer): the CDU laws, plus every source quote found verbatim at its cited line.
 * Browser laws (4, 5, 6 on the page) are in browserR120().
 *
 * RED/GREEN: RZPID_ROOT=<dir with the committed js/> runs the same laws against the pre-R120 modules.
 */
import fs from 'node:fs';
import path from 'node:path';

export function nodeR120(ctx) {
  const { P, CDU, check, ROOT, FIX, readJson, edges, eq } = ctx;
  const fn = (k) => typeof P[k] === 'function';
  const pg = (n, dn, kw) => Object.assign({ page: n, sheet: { drawing_number: dn } }, kw);
  const codes = (g) => g.issues.map((i) => i.code);
  const build = (pages) => P.buildGraph(pages, 't', 't');

  /* ---------------------------------------------------------------- 1. cross-sheet parity */
  /* Hand derivation (build.py _opc_score) for the fixture: P01.OPC1 out, sheet PID-100, other_drawing PID-200, line 3"-PW-002,
     label 'TO PRODUCT TANK', other_item TK-200; P02.OPC1 in, sheet PID-200, other_drawing PID-100, same line, label 'FROM TRANSFER
     PUMP P-101'. No contradiction. +3 (PID-200 = in sheet) +3 (PID-100 = out sheet) +4 (same line) + 2 x jaccard({PRODUCT,
     TANK, TK-200}, {TRANSFER, PUMP, P-101}) = 0  ->  10. Accepted (>= 3): FLOWS_TO P01.OPC1 -> P02.OPC1, confidence
     min(0.9, 0.9) = 0.9, match_score 10; neither connector is reported. Equipment level: FEEDS P-101 -> TK-200, off_page. */
  const mini = P.buildGraph(['page_01.json', 'page_02.json'].map((f) => readJson(path.join(FIX, f))), 'mini', 'Mini plant');
  const opc = mini.edges.find((e) => e.type === 'FLOWS_TO' && e.source === 'P01.OPC1' && e.target === 'P02.OPC1');
  check('r120 parity: fixture pairing score = 10 by hand (3 + 3 + 4 + 2 x 0)', !!opc && opc.attributes.match_score === 10, opc && JSON.stringify(opc.attributes));
  check('r120 parity: fixture pairing confidence 0.9, linked_from set', !!opc && opc.confidence === 0.9 && mini.byId['P02.OPC1'].attributes.linked_from === 'P01.OPC1');
  check('r120 parity: fixture reports no unmatched or mismatched connector', !codes(mini).some((c) => /off_page/.test(c)), JSON.stringify(codes(mini)));
  const f101 = mini.edges.find((e) => e.type === 'FEEDS' && e.source === 'P-101' && e.target === 'TK-200');
  check('r120 parity: fixture FEEDS P-101 -> TK-200 crosses sheets (off_page)', !!f101 && f101.attributes.off_page === true);

  const tank = (id, tag) => ({ id, tag, kind: 'tank' });
  { /* test_off_page_pairing_is_one_to_one_and_respects_drawing_numbers */
    const g = build([pg(1, 'PID-A', { equipment: [tank('T1', 'T-1')], lines: [{ id: 'L1', line_number: '2-X-001', from: 'T1', to: 'O1' }, { id: 'L2', line_number: '2-X-002', from: 'T1', to: 'O2' }],
      off_page_connectors: [{ id: 'O1', direction: 'out', other_drawing: 'PID-B', line_number: '2-X-001' }, { id: 'O2', direction: 'out', other_drawing: 'PID-Z', line_number: '2-X-002' }] }),
    pg(2, 'PID-B', { equipment: [tank('T2', 'T-2')], lines: [{ id: 'L1', line_number: '2-X-001', from: 'I1', to: 'T2' }],
      off_page_connectors: [{ id: 'I1', direction: 'in', other_drawing: 'PID-A', line_number: '2-X-001' }] })]);
    const fl = edges(g, 'FLOWS_TO'), un = g.issues.filter((i) => i.code === 'unmatched_off_page');
    check('r120 ref one_to_one: P01.O1 -> P02.I1, not P01.O2', fl.has('P01.O1 -> P02.I1') && !fl.has('P01.O2 -> P02.I1'));
    check('r120 ref one_to_one: unmatched == [P01.O2]', eq(un.map((i) => i.node), ['P01.O2']), JSON.stringify(un));
    check('r120 parity: unmatched message names where the flag points ("(to PID-Z)")', un.length === 1 && /\(to PID-Z\)/.test(un[0].message), un[0] && un[0].message);
  }
  const twoTanks = (dnA, dnB, oA, iB, ln) => [
    pg(1, dnA, { equipment: [tank('T1', 'T-1')], lines: [Object.assign({ id: 'L1', from: 'T1', to: 'O1' }, ln ? { line_number: ln } : {})],
      off_page_connectors: [Object.assign({ id: 'O1', direction: 'out', other_drawing: oA }, ln ? { line_number: ln } : {})] }),
    pg(2, dnB, { equipment: [tank('T2', 'T-2')], lines: [Object.assign({ id: 'L1', from: 'I1', to: 'T2' }, ln ? { line_number: ln } : {})],
      off_page_connectors: [Object.assign({ id: 'I1', direction: 'in', other_drawing: iB }, ln ? { line_number: ln } : {})] })];
  { /* test_off_page_line_number_overrides_wrong_flag_and_is_flagged: score = -1 (contradiction) + 3 (D-007 ~ D-007-0) + 4 = 6 */
    const g = build(twoTanks('D-007-0', 'D-009-0', 'D-099', 'D-007', '400-RWW-H1'));
    check('r120 ref line_number_overrides: FEEDS T-1 -> T-2', edges(g, 'FEEDS').has('T-1 -> T-2'));
    check('r120 ref line_number_overrides: off_page_reference_mismatch reported', codes(g).includes('off_page_reference_mismatch'), JSON.stringify(codes(g)));
    const e = g.edges.find((x) => x.type === 'FLOWS_TO' && x.source === 'P01.O1');
    check('r120 parity: mismatch pair kept with match_score 6 (-1 + 3 + 4) by hand', !!e && e.attributes.match_score === 6, e && JSON.stringify(e.attributes));
  }
  { /* test_revision_suffix_matches_drawing_number */
    const g = build(twoTanks('D-007-0', 'D-009-0', 'D-009', 'D-007'));
    check('r120 ref revision_suffix: FEEDS T-1 -> T-2, no mismatch', edges(g, 'FEEDS').has('T-1 -> T-2') && !codes(g).includes('off_page_reference_mismatch'));
  }
  const litSheet = (n, eqTag, measTag) => pg(n, 'S-' + n, { equipment: [tank(eqTag, eqTag)], instruments: [{ id: 'LIT', tag: 'LIT-0101', measures: { item: measTag } }] });
  { /* test_same_tag_on_two_sheets_measuring_different_equipment_is_kept_apart */
    const g = build([litSheet(1, 'TK-1', 'TK-1'), litSheet(2, 'TK-2', 'TK-2')]);
    const lit = g.nodes.filter((n) => n.tag === 'LIT-0101').map((n) => n.id).sort();
    check('r120 ref tag scoping: LIT-0101@S-1 and LIT-0101@S-2', eq(lit, ['LIT-0101@S-1', 'LIT-0101@S-2']), JSON.stringify(lit));
    check('r120 ref tag scoping: tag_reused reported', codes(g).includes('tag_reused'), JSON.stringify(codes(g)));
    check('r120 parity: scoped LIT measures its own sheet\'s tank', edges(g, 'MEASURES').has('LIT-0101@S-1 -> TK-1') && edges(g, 'MEASURES').has('LIT-0101@S-2 -> TK-2'));
  }
  { /* test_same_tag_on_two_sheets_for_same_item_merges */
    const g = build([litSheet(1, 'TK-1', 'TK-1'), litSheet(2, 'TK-1', 'TK-1')]);
    check('r120 ref same item merges: one LIT-0101', eq(g.nodes.filter((n) => n.tag === 'LIT-0101').map((n) => n.id), ['LIT-0101']));
  }
  { /* test_duplicate_tag_on_one_sheet_gets_separate_nodes_and_loops */
    const g = build([pg(1, 'S-1', { equipment: [{ id: 'P1', tag: 'P-1', kind: 'pump' }, { id: 'P2', tag: 'P-2', kind: 'pump' }],
      instruments: [{ id: 'A', tag: 'PI-0502', measures: { item: 'P1' } }, { id: 'B', tag: 'PI-0502', measures: { item: 'P2' } }] })]);
    const ids = new Set(g.nodes.map((n) => n.id));
    check('r120 ref duplicate tag: PI-0502 and PI-0502#2, duplicate_tag, no loop', ids.has('PI-0502') && ids.has('PI-0502#2') && codes(g).includes('duplicate_tag') && !g.nodes.some((n) => n.type === 'ControlLoop'));
  }
  { /* equipment scoping (tag_scopes equipment branch): P-1 on two sheets reaching disjoint terminals, neither sheet points at the other */
    const pumpSheet = (n, a, b, opcs) => pg(n, 'S-' + n, { equipment: [{ id: 'P', tag: 'P-1', kind: 'pump' }],
      boundaries: [{ id: 'BI', name: 'FEED ' + a, direction: 'source' }, { id: 'BO', name: 'OUT ' + b, direction: 'sink' }],
      lines: [{ id: 'L1', from: 'BI', to: 'P' }, { id: 'L2', from: 'P', to: 'BO' }], off_page_connectors: opcs || [] });
    const g = build([pumpSheet(1, 'A', 'A'), pumpSheet(2, 'B', 'B')]);
    check('r120 parity: equipment scoping P-1@S-1 / P-1@S-2', eq(g.nodes.filter((n) => n.tag === 'P-1').map((n) => n.id).sort(), ['P-1@S-1', 'P-1@S-2']), JSON.stringify(g.nodes.filter((n) => n.tag === 'P-1').map((n) => n.id)));
    const g2 = build([pumpSheet(1, 'A', 'A', [{ id: 'X', direction: 'out', other_drawing: 'S-2' }]), pumpSheet(2, 'B', 'B')]);
    check('r120 parity: a sheet that points at the other keeps one P-1', eq(g2.nodes.filter((n) => n.tag === 'P-1').map((n) => n.id), ['P-1']));
  }
  { /* name_conflict (build.py _upsert): same tag, different description on two sheets; similar names do not count */
    const named = (n, name) => pg(n, 'S-' + n, { equipment: [{ id: 'T', tag: 'TK-1', kind: 'tank', name }], boundaries: [{ id: 'B', name: 'FEED', direction: 'source' }], lines: [{ id: 'L', from: 'B', to: 'T' }] });
    const g = build([named(1, 'FEED TANK'), named(2, 'ACID STORE')]);
    check('r120 parity: name_conflict on TK-1 (FEED TANK vs ACID STORE)', g.issues.some((i) => i.code === 'name_conflict' && i.node === 'TK-1'), JSON.stringify(codes(g)));
    check('r120 parity: other_names keeps the second name', eq(g.byId['TK-1'].attributes.other_names, ['ACID STORE']));
    check('r120 parity: SUMP vs WTP SUMP is not a conflict', !codes(build([named(1, 'SUMP'), named(2, 'WTP SUMP')])).includes('name_conflict'));
  }

  /* ---------------------------------------------------------------- 2. QA (qa.py run_qa) */
  check('r120 qa: RZPid.qa exported', fn('qa'));
  if (fn('qa')) {
    const q = P.qa(build([pg(1, 'S-1', {
      equipment: [tank('T', 'TK-06'), tank('T2', 'TK-006'), { id: 'Q', tag: 'Q-1', kind: 'gizmo' }, { id: 'TK', tag: 'TK-9', kind: 'tank' }, { id: 'AG', tag: 'AG-1', kind: 'agitator', part_of: 'TK' }],
      components: [{ id: 'V9', tag: 'HV-9', kind: 'gate_valve', confidence: 0.4, attributes: { basis: 'half hidden under a note' } }],
      boundaries: [{ id: 'B', name: 'FEED', direction: 'source' }],
      lines: [{ id: 'L', from: 'B', to: 'T', flow_direction: 'inferred' }, { id: 'L2', from: 'T', to: 'P-404' }, { id: 'L3', from: 'B', to: 'TK' }],
      instruments: [{ id: 'PT', tag: 'PT-5', location: 'field' }, { id: 'FT', tag: 'FT-7', location: 'field', measures: { line: 'L' } }, { id: 'FC', tag: 'FIC-7', location: 'dcs' }],
      signals: [{ from: 'FT', to: 'FC' }] })]));
    const have = new Set(q.issues.map((i) => i.code));
    for (const c of ['unresolved_reference', 'equipment_not_connected', 'component_not_connected', 'instrument_not_located', 'isolated_instrument', 'low_confidence',
      'near_duplicate_tags', 'inferred_flow_direction', 'unknown_kind', 'loop_no_final_element'])
      check('r120 qa: category ' + c + ' reported on the seeded plant', have.has(c), [...have].join(','));
    check('r120 qa: part_of equipment is not unconnected (ref test_part_of_equipment_is_not_unconnected)', !q.issues.some((i) => i.code === 'equipment_not_connected' && i.node === 'AG-1'));
    check('r120 qa: low_confidence carries the item\'s basis', q.issues.some((i) => i.code === 'low_confidence' && i.node === 'HV-9' && i.basis === 'half hidden under a note'));
    const sev = { error: 0, warning: 1, info: 2 };
    check('r120 qa: sorted error -> warning -> info, counts add up', q.issues.every((x, i, a) => !i || sev[a[i - 1].severity] <= sev[x.severity]) &&
      q.counts.error + q.counts.warning + q.counts.info === q.issues.length && q.byCode.reduce((s, b) => s + b.count, 0) === q.issues.length);
    const rev = (n) => pg(n, 'S-' + n, { equipment: ['A', 'B', 'C', 'D', 'E'].map((x) => tank(x, 'TK-' + x + '1')) });
    check('r120 qa: possible_duplicate_revision on two sheets sharing 5 of 5 tags', P.qa(build([rev(1), rev(2)])).issues.some((i) => i.code === 'possible_duplicate_revision'));
    check('r120 qa: unmatched off-page connector is in the QA list', P.qa(build(twoTanks('S-1', 'S-2', 'S-9', 'S-8'))).issues.some((i) => i.code === 'unmatched_off_page'));
  }

  /* ---------------------------------------------------------------- 3. queries on the CDU plant */
  const doc = readJson(path.join(ROOT, 'data/pid/cdu-secondary-loop.json'));
  const g = P.buildGraph(doc.pages, doc.plant.id, doc.plant.name);
  if (fn('qa')) {
    const q = P.qa(g, { props: CDU.fluidProps });
    check('r120 qa: CDU has no error or warning in QA', !q.counts.error && !q.counts.warning, JSON.stringify(q.byCode));
    const hb = q.issues.find((i) => i.code === 'heat_balance_discrepancy');
    check('r120 qa: CDU heat-balance discrepancy carried as info with its arithmetic and both quotes', !!hb && /275\.7 kW/.test(hb.calc) && hb.quotes.length === 2);
  }
  for (const k of ['trace', 'loopOf', 'impact', 'live']) check('r120 api: RZPid.' + k + ' exported', fn(k));
  if (fn('trace')) {
    check('r120 trace: down from HV-03 reaches only the rack supply', eq(P.trace(g, 'HV-03').equipment, ['BOUNDARY:TO RACK MANIFOLD M-01']), JSON.stringify(P.trace(g, 'HV-03').equipment));
    const up = P.trace(g, 'F-01', { dir: 'up' }).equipment;
    check('r120 trace: up from F-01 reaches both pumps, E-01, T-01 and the rack return', ['P-01A', 'P-01B', 'E-01', 'T-01', 'BOUNDARY:FROM RACK MANIFOLD M-01'].every((x) => up.includes(x)), JSON.stringify(up));
    check('r120 trace: E-01 keeps its streams apart (up from F-01 never reaches facility water)', !up.some((x) => /FACILITY WATER/.test(x)), JSON.stringify(up));
  }
  if (fn('loopOf')) {
    const lo = (id) => P.loopOf(g, id).map((x) => x.loop + ':' + x.role).sort();
    check('r120 loopOf: TCV-01 is T-01\'s final element', eq(lo('TCV-01'), ['LOOP:T-01:final_element']), JSON.stringify(lo('TCV-01')));
    check('r120 loopOf: P-01A is final in LS-01 and PD-02', eq(lo('P-01A'), ['LOOP:LS-01:final_element', 'LOOP:PD-02:final_element']), JSON.stringify(lo('P-01A')));
    check('r120 loopOf: the rack-supply segment is measured by PD-02', eq(lo('P01.L-SUP.3'), ['LOOP:PD-02:measured']), JSON.stringify(lo('P01.L-SUP.3')));
  }
  if (fn('impact')) {
    const im = (id, o) => P.impact(g, id, o), rd = (r, id) => (r.readings.find((x) => x.id === id) || {}).reads;
    const resp = (r, loop) => r.responses.find((x) => x.loop === loop) || {};
    /* HV-03 closed: the TCS circuit has no path to a sink -> rack supply loses flow; FT-01 (in-line, flow) reads low; PDT-02 sits
       downstream of HV-03 -> low; PDIC-02 raises dP -> the running pump (P-01A; P-01B is standby) speeds up through SY-01A. */
    const a = im('HV-03');
    check('r120 impact HV-03 closed: rack supply loses flow', a.mode === 'closed' && a.lost.includes('BOUNDARY:TO RACK MANIFOLD M-01'), JSON.stringify(a.lost));
    check('r120 impact HV-03 closed: FT-01 reads low, PDT-02 low, PT-01 high (dead-headed upstream)', rd(a, 'FT-01') === 'low' && rd(a, 'PDT-02') === 'low' && rd(a, 'PT-01') === 'high', JSON.stringify(a.readings));
    const pd = resp(a, 'LOOP:PD-02');
    check('r120 impact HV-03 closed: PD-02 drives the running pump up (P-01A speeds up)', pd.action === 'raise' && eq(pd.acts, [{ id: 'P-01A', verb: 'speeds up' }]), JSON.stringify(pd));
    check('r120 impact: chain is cause -> effect -> response -> sees', eq([...new Set(a.chain.map((c) => c.kind))], ['cause', 'effect', 'response', 'sees']), JSON.stringify(a.chain.map((c) => c.kind)));
    /* P-01A trips: P-01B (standby, same FEEDS in and out) takes over; rack supply keeps flow; CK-A lies between P-01A and the
       point where P-01B's flow joins (L-D2 tees into L-D1 after CK-A) -> it is what stops backflow. */
    const b = im('P-01A');
    check('r120 impact P-01A trips: P-01B takes over', eq(b.takeover, [{ failed: 'P-01A', by: 'P-01B' }]), JSON.stringify(b.takeover));
    check('r120 impact P-01A trips: rack supply keeps flow', !b.lost.includes('BOUNDARY:TO RACK MANIFOLD M-01'), JSON.stringify(b.lost));
    check('r120 impact P-01A trips: CK-A prevents backflow', b.backflow.length === 1 && eq(b.backflow[0].valves, ['P01.CK-A']), JSON.stringify(b.backflow));
    check('r120 impact P-01A trips: PD-02 now drives P-01B', eq(resp(b, 'LOOP:PD-02').finals, ['P-01B']));
    /* E-01 fouled: the TCS stream enters on 'TCS return' (warm) so its outlet reads high: TT-01; TI-03 (on E-01) high; TIC-01
       lowers TT-01 by moving TCV-01, which feeds E-01's cold (FW supply) stream -> opens. */
    const c = im('E-01');
    check('r120 impact E-01 fouled: TT-01 and TI-03 read high', c.mode === 'fouled' && rd(c, 'TT-01') === 'high' && rd(c, 'TI-03') === 'high', JSON.stringify(c.readings));
    check('r120 impact E-01 fouled: T-01 loop opens TCV-01', eq(resp(c, 'LOOP:T-01').acts, [{ id: 'TCV-01', verb: 'opens' }]), JSON.stringify(resp(c, 'LOOP:T-01')));
    check('r120 impact E-01 fouled: no flow is lost', !c.lost.length);
    const d = im('LSH-01');
    check('r120 impact LSH-01 trips falsely: interlock LS-01 stops both pumps, no standby left, rack loses flow',
      resp(d, 'LOOP:LS-01').action === 'stops' && !d.takeover.length && d.lost.includes('BOUNDARY:TO RACK MANIFOLD M-01'), JSON.stringify(d.responses));
    const e = im('TT-01');
    check('r120 impact TT-01 fails low: TIC-01 closes TCV-01 (it believes the supply is too cold)', eq(resp(e, 'LOOP:T-01').acts, [{ id: 'TCV-01', verb: 'closes' }]));
    check('r120 impact: every chain text names only items in the graph (generated)', ['HV-03', 'P-01A', 'E-01'].every((id) => im(id).chain.every((x) => x.ids.every((i) => !!g.byId[i]))));
    const renamed = JSON.parse(JSON.stringify(doc)); renamed.pages[0].components.find((x) => x.id === 'HV-03').tag = 'HV-93';
    const g2 = P.buildGraph(renamed.pages, 'x', 'x');
    check('r120 impact: renaming the valve in the data renames it in the consequences (not hand-written)', /HV-93/.test(P.impact(g2, 'HV-93').chain[0].text) && !/HV-03/.test(P.impact(g2, 'HV-93').chain.map((x) => x.text).join(' ')));
  }

  /* ---------------------------------------------------------------- 5. live values */
  if (fn('live')) {
    const calls = { q: 0, f: 0 };
    const eng = { hydronicQkW: (...x) => { calls.q++; return CDU.hydronicQkW(...x); }, flowLpmFromQ: (...x) => { calls.f++; return CDU.flowLpmFromQ(...x); } };
    const bal = P.balance(g, CDU.fluidProps).find((r) => r.node === 'E-01'), v = P.live(g, CDU.fluidProps, eng, 1);
    const same = (x, y) => Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(y));
    check('r120 live: at 100 % flow = balance().need_lpm, rise = dT, return = t_return, duty = declared', !!v && same(v.flow_lpm, bal.need_lpm) && same(v.dT, bal.dT) && same(v.t_return, bal.t_return) && v.q_kw === bal.declared_kw,
      JSON.stringify(v && { f: v.flow_lpm, need: bal.need_lpm, dT: v.dT, tr: v.t_return }));
    check('r120 live: computed through CDU_ENGINE (flowLpmFromQ and hydronicQkW called)', calls.q > 0 && calls.f > 0, JSON.stringify(calls));
    const runs = [];
    for (let L = 50; L <= 100; L += 5) runs.push(P.live(g, CDU.fluidProps, CDU, L / 100));
    check('r120 live: rise and return rise strictly with load; flow is held', runs.every((x, i) => !i || (x.dT > runs[i - 1].dT && x.t_return > runs[i - 1].t_return && same(x.flow_lpm, runs[0].flow_lpm))));
    check('r120 live: the declared FT-01 value stays quoted as declared (390)', g.byId['FT-01'].attributes.flow_lpm === 390);
  }

  /* ---------------------------------------------------------------- 6. second plant: fuel day-tank transfer */
  const FUEL = path.join(ROOT, 'data/pid/fuel-day-tank.json');
  check('r120 fuel: data/pid/fuel-day-tank.json exists', fs.existsSync(FUEL));
  if (fs.existsSync(FUEL)) fuelLaws(ctx, readJson(FUEL));
}

function fuelLaws(ctx, doc) {
  const { P, check, ROOT, FIX, readJson, edges, eq } = ctx;
  const schema = readJson(path.join(FIX, 'extraction.schema.json'));
  const errs = []; doc.pages.forEach((p, i) => ctx.validate(p, schema, 'fuel page ' + (i + 1), errs));
  check('r120 fuel: page validates against the reference extraction schema', !errs.length, errs.slice(0, 4).join('; '));
  const g = P.buildGraph(doc.pages, doc.plant.id, doc.plant.name), ex = P.explain(g);
  check('r120 fuel: no build errors or warnings', !g.issues.some((i) => i.severity !== 'info'), JSON.stringify(g.issues.filter((i) => i.severity !== 'info')));
  const src = fs.readFileSync(path.join(ROOT, doc.source_page), 'utf8').split('\n');
  for (const [k, s] of Object.entries(doc.sources))
    check('r120 fuel: source ' + k + ' quote is at ' + doc.source_page + ' line ' + s.line, s.line > 0 && (src[s.line - 1] || '').includes(s.quote), (src[s.line - 1] || '').slice(0, 120));
  const loopsOf = {};
  g.edges.filter((e) => e.type === 'MEMBER_OF').forEach((e) => { loopsOf[e.source] = 1; });
  for (const n of g.nodes.filter((x) => x.type === 'Instrument')) check('r120 fuel: ' + n.id + ' in a loop or explicitly standalone', !!loopsOf[n.id] !== !!n.attributes.standalone);
  const items = [];
  for (const p of doc.pages) for (const grp of ['equipment', 'components', 'instruments', 'boundaries']) for (const it of p[grp] || []) items.push([grp, it]);
  for (const [grp, it] of items) {
    const a = it.attributes || {};
    if (grp !== 'boundaries') check('r120 fuel: ' + it.id + ' names a source that exists', !!a.src && !!doc.sources[a.src], 'src=' + a.src);
    if ((it.confidence ?? 0.9) < P.LOW_CONFIDENCE) check('r120 fuel: low-confidence ' + it.id + ' says why', !!(a.basis || it.notes));
  }
  const flowSteps = ex.steps.filter((s) => s.section === 'flow');
  /* the CDU law, with the case the CDU does not have: a consumer that feeds nothing (a genset) is lit by a flow step instead */
  for (const n of g.nodes.filter((x) => x.type === 'Equipment')) {
    const feeds = g.edges.some((e) => e.type === 'FEEDS' && e.source === n.id);
    if (feeds) check('r120 fuel: equipment ' + n.id + ' is the subject of exactly one flow step', flowSteps.filter((s) => s.subject === n.id).length === 1);
    else check('r120 fuel: consumer ' + n.id + ' (feeds nothing) is lit by a flow step and the subject of none', flowSteps.some((s) => s.ids.includes(n.id)) && !flowSteps.some((s) => s.subject === n.id));
  }
  const known = new Set(g.nodes.map((n) => n.id).concat(g.edges.map((e) => e.id)));
  check('r120 fuel: every step\'s ids exist', ex.steps.every((s) => s.ids.length && s.ids.every((i) => known.has(i))));
  const anchorOf = (id) => doc.layout.anchors[id] || (() => { const b = items.find(([, x]) => x.id === id)[1].bbox; return [(b[0] + b[2]) / 2 * doc.layout.viewBox[0], (b[1] + b[3]) / 2 * doc.layout.viewBox[1]]; })();
  for (const l of doc.pages[0].lines) {
    const r = doc.layout.routes[l.id]; let at = 0, ok = !!r;
    for (const ref of l.path || []) { if (!ok) break; const a = anchorOf(ref); const i = r.findIndex((p, k) => k >= at && Math.abs(p[0] - a[0]) < 0.6 && Math.abs(p[1] - a[1]) < 0.6); if (i < 0) ok = false; else at = i; }
    check('r120 fuel: route ' + l.id + ' passes its path items in order', ok);
  }
  const dbSrc = fs.readFileSync(path.join(ROOT, 'js/rz-explain-db.js'), 'utf8');
  const DB = JSON.parse(dbSrc.slice(dbSrc.indexOf('{', dbSrc.indexOf('RZ_EXPLAIN_DB')), dbSrc.lastIndexOf('}') + 1)).entries;
  for (const n of g.nodes.filter((x) => P.explainKey(x))) check('r120 fuel: ' + n.id + ' ISA key ' + P.explainKey(n) + ' in the DB, title = decodeTag()', !!DB[P.explainKey(n)] && DB[P.explainKey(n)].t === P.decodeTag(n.tag).text);
  /* the same failure rules, unchanged, on a different plant: P-101 trips -> P-102 (standby) takes over; the page draws a check
     valve on each pump discharge (fuel-system.html line 855), so the one on P-101's discharge stops backflow. */
  const t = P.impact(g, 'P-101');
  check('r120 fuel impact: P-101 trips -> P-102 takes over', eq(t.takeover, [{ failed: 'P-101', by: 'P-102' }]), JSON.stringify(t.takeover));
  check('r120 fuel impact: P-101\'s discharge check valve stops backflow', t.backflow.length === 1 && t.backflow[0].valves.length === 1 && g.byId[t.backflow[0].valves[0]].kind === 'check_valve', JSON.stringify(t.backflow));
  const xv = P.impact(g, 'XV-A');
  check('r120 fuel impact: XV-A closed -> DT-GEN-A is no longer filled, GEN-A still runs on the day tank', xv.stores.includes('DT-GEN-A') && !xv.lost.includes('GEN-A'), JSON.stringify({ s: xv.stores, l: xv.lost }));
  check('r120 fuel: QA has no error or warning', !P.qa(g).counts.error && !P.qa(g).counts.warning, JSON.stringify(P.qa(g).byCode));
}

/* Browser laws. `open(width, reduce, query)` is the gate's own page opener. */
export async function browserR120(ctx) {
  const { open, check, P } = ctx;
  /* 4 + 5 at 1440: generated QA panel, what-if mode by keyboard, live values */
  const { p, errs } = await open(1440, false, '');
  const q = await p.evaluate(() => {
    const api = document.querySelector('.rzpid').__rzpid, out = {};
    const qa = RZPid.qa ? RZPid.qa(api.graph, { props: CDU_ENGINE.fluidProps, lowConfidence: RZPid.LOW_CONFIDENCE }) : null;
    out.qaN = qa ? qa.issues.length : -1;
    out.panelN = document.querySelectorAll('#lowList [data-qa-code]').length;
    out.codes = qa ? [...new Set(qa.issues.map((i) => i.code))].sort().join(',') : '';
    out.panelCodes = [...new Set([...document.querySelectorAll('#lowList [data-qa-code]')].map((e) => e.getAttribute('data-qa-code')))].sort().join(',');
    out.panelItems = [...document.querySelectorAll('#lowList [data-qa-code]')].reduce((s, e) => s + (+e.getAttribute('data-qa-n') || 1), 0);
    return out;
  });
  check('r120 page: "marked, not guessed" panel is generated from RZPid.qa() (same codes, every issue counted)', q.qaN > 0 && q.codes === q.panelCodes && q.panelItems === q.qaN, JSON.stringify(q));
  /* keyboard: Tab to the toggle, Enter, then Tab to HV-03's symbol and Enter */
  const kb = await p.evaluate(() => { const b = document.querySelector('.rzpid-whatif-btn'); if (!b) return null; b.focus(); return document.activeElement === b; });
  check('r120 what-if: the toggle exists and takes focus', kb === true);
  if (kb) {
    await p.keyboard.press('Enter');
    const on = await p.evaluate(() => document.querySelector('.rzpid-whatif-btn').getAttribute('aria-pressed'));
    check('r120 what-if: Enter turns it on (aria-pressed true)', on === 'true', on);
    let reached = false;
    /* the symbols sit before the toggle in the DOM: Shift+Tab walks back into the drawing */
    await p.keyboard.down('Shift');
    for (let i = 0; i < 80 && !reached; i++) { await p.keyboard.press('Tab'); reached = await p.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-id') === 'HV-03'); }
    await p.keyboard.up('Shift');
    check('r120 what-if: HV-03 is reachable by keyboard in what-if mode', reached);
    await p.keyboard.press('Enter');
    const w = await p.evaluate(() => {
      const api = document.querySelector('.rzpid').__rzpid, svg = api.svg, r = RZPid.impact(api.graph, 'HV-03');
      const li = [...document.querySelectorAll('.rzpid-impact li')].map((x) => x.textContent.trim());
      const seg = svg.querySelector('[data-id="P01.L-SUP.3"] .pipe'), sel = svg.querySelector('g.node[data-id="HV-03"] .sym');
      const css = getComputedStyle(svg);
      return { li, want: r.chain.map((c) => c.text), segFault: svg.querySelector('[data-id="P01.L-SUP.3"]').classList.contains('is-fault'),
        segStroke: getComputedStyle(seg).stroke, fault: css.getPropertyValue('--pid-fault').trim(), accent: css.getPropertyValue('--pid-accent').trim(),
        selStroke: getComputedStyle(sel).stroke, selLit: svg.querySelector('g.node[data-id="HV-03"]').classList.contains('is-lit'),
        fwFault: svg.querySelector('[data-id="P01.L-FWS.1"]').classList.contains('is-fault') };
    });
    check('r120 what-if: the consequence list equals RZPid.impact(HV-03).chain, in order', w.li.length > 3 && JSON.stringify(w.li) === JSON.stringify(w.want), JSON.stringify(w.li).slice(0, 300));
    const rgb = (h) => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(h); return m ? 'rgb(' + parseInt(m[1], 16) + ', ' + parseInt(m[2], 16) + ', ' + parseInt(m[3], 16) + ')' : h; };
    check('r120 what-if: the rack-supply segment is drawn in the fault token, the facility-water side is not', w.segFault && w.segStroke === rgb(w.fault) && !w.fwFault, JSON.stringify(w));
    check('r120 what-if: the selected valve stays amber (selection), fault red is not a second accent', w.selLit && w.selStroke === rgb(w.accent) && rgb(w.fault) !== rgb(w.accent), JSON.stringify(w));
  }
  /* 5: the load control recomputes the labels and the balance line */
  const lv = await p.evaluate(() => {
    const s = document.getElementById('loadCtl'); if (!s) return null;
    const val = (id) => { const t = document.querySelector('.rzpid-svg [data-val-of="' + id + '"]'); return t ? t.textContent : null; };
    const at100 = { ft: val('FT-01'), tr: val('TT-02'), line: document.getElementById('liveLine').textContent };
    s.value = '75'; s.dispatchEvent(new Event('input', { bubbles: true }));
    const prov = document.getElementById('liveProv');
    return { at100, at75: { ft: val('FT-01'), tr: val('TT-02'), line: document.getElementById('liveLine').textContent },
      prov: prov && prov.getAttribute('data-rz-provenance'), provText: prov && prov.textContent, declared: (document.getElementById('liveDeclared') || {}).textContent || '' };
  });
  check('r120 live page: load control present', !!lv);
  if (lv) {
    check('r120 live page: at 100 % the labels equal balance() (424 LPM, 43.0 °C)', lv.at100.ft === '424 LPM' && lv.at100.tr === '43.0 °C', JSON.stringify(lv.at100));
    check('r120 live page: at 75 % the return label and the balance line update (225.0 kW, 40.2 °C)', lv.at75.tr === '40.2 °C' && /225\.0 kW/.test(lv.at75.line) && lv.at75.line !== lv.at100.line, JSON.stringify(lv.at75));
    check('r120 live page: marked "Model output" through RZProvenance', lv.prov === 'model' && /^Model output/.test(lv.provText), JSON.stringify([lv.prov, lv.provText]));
    check('r120 live page: the declared values stay quoted (1.30 LPM/kW, 32 °C, 11 °C)', /1\.30 LPM\/kW/.test(lv.declared) && /32 °C/.test(lv.declared) && /11 °C/.test(lv.declared), lv.declared);
  }
  check('r120 page 1440: no page errors', !errs.length, errs.join(' | '));
  await p.close();
  /* reduced motion in what-if: the fault state changes without transitions longer than 1 ms */
  const rm = await open(1440, true, '');
  const rmr = await rm.p.evaluate(() => {
    const b = document.querySelector('.rzpid-whatif-btn'); if (!b) return null; b.click();
    const api = document.querySelector('.rzpid').__rzpid; api.whatIf('P-01A');
    const el = api.svg.querySelector('[data-id="P01.L-D1.1"]'), d = getComputedStyle(el).transitionDuration;
    return { d, fault: el.classList.contains('is-fault'), n: document.querySelectorAll('.rzpid-impact li').length };
  });
  check('r120 what-if reduced motion: fault state set, transitions <= 1 ms', !!rmr && rmr.fault && rmr.n > 2 && rmr.d.split(',').every((x) => parseFloat(x) <= 0.001), JSON.stringify(rmr));
  await rm.p.close();
  /* 6: the fuel plant renders at 1440 and 390 */
  for (const w of [1440, 390]) {
    const f = await open(w, true, '?plant=fuel');
    const fr = await f.p.evaluate(() => {
      const api = document.querySelector('.rzpid').__rzpid, frame = api.svg.closest('.rzpid-frame');
      return { plant: api.graph.plant.id, sw: document.documentElement.scrollWidth, fw: frame.scrollWidth, fc: frame.clientWidth, steps: api.explanation.steps.length,
        live: !!document.getElementById('loadCtl') && document.getElementById('loadCtl').offsetParent !== null };
    });
    check('r120 fuel page ' + w + ': renders the fuel plant with its steps', fr.plant === 'fuel-day-tank' && fr.steps > 5, JSON.stringify(fr));
    check('r120 fuel page ' + w + ': no sideways pan', fr.sw <= w && (w > 600 || fr.fw <= fr.fc + 1), JSON.stringify(fr));
    check('r120 fuel page ' + w + ': no load control (the fuel page gives no heat balance)', !fr.live);
    check('r120 fuel page ' + w + ': no page errors', !f.errs.length, f.errs.join(' | '));
    await f.p.close();
  }
}
