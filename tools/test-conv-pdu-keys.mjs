#!/usr/bin/env node
/* PRD-ELECTRICAL-BMS E18 (owner R191, engine 2.9.0) — the floor PDU below the distribution transformer.
 *
 * Laws:
 *   PDU1 the engine publishes the authored PDU inputs and racks_per_row, each registered with its evidence class.
 *   PDU2 pdu_per_hall_per_stream is the SMALLEST count whose usable capacity (kVA x pf x max loading) carries the
 *        largest hall's IT design load on one stream (2N), and the contingency loading never exceeds max loading.
 *   PDU3 normal loading = hall IT / streams / installed kW·pf; rows_per_hall x racks_per_row = hall racks;
 *        racks_per_pdu is the smallest whole share that covers every rack.
 *   PDU4 every new derived key is registered DERIVED with a formulaExpr (evaluated by test-conv-formula).
 *
 * Red: on engine 2.8.0 PDU1-PDU4 fail (no key exists). Run: node tools/test-conv-pdu-keys.mjs [path/to/conv-engine.js]
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const enginePath = process.argv[2] ? resolve(process.argv[2]) : join(ROOT, 'js', 'conv-engine.js');
const sandbox = { window: {}, module: { exports: {} }, console };
vm.createContext(sandbox);
vm.runInContext(readFileSync(enginePath, 'utf8'), sandbox, { filename: 'conv-engine.js' });
const calc = sandbox.window.CONV_CALC;
const el = calc.snapshot.electrical;
const halls = calc.listHalls();
const reg = JSON.parse(readFileSync(join(ROOT, 'data', 'conv-parameters.json'), 'utf8'));
const byId = new Map((reg.parameters || []).map((p) => [p.id, p]));

let pass = 0;
const fails = [];
function check(law, ok, msg) { if (ok) pass++; else fails.push(law + ' ' + msg); }
const num = (v) => typeof v === 'number' && Number.isFinite(v);

/* PDU1 */
const AUTHORED = { pdu_kva_rated: 'ASSUMED', pdu_power_factor: 'ASSUMED', pdu_max_loading_pct: 'STANDARD', racks_per_row: 'ADOPTED' };
for (const [k, cls] of Object.entries(AUTHORED)) {
    check('PDU1', num(el[k]) && el[k] > 0, k + ' published as a positive number (got ' + el[k] + ')');
    const r = byId.get('electrical.' + k);
    check('PDU1', !!r && r.evidenceClass === cls, k + ' registered ' + cls + ' (got ' + (r && r.evidenceClass) + ')');
}

/* PDU2 */
const itMax = halls.reduce((m, h) => Math.max(m, h.it_design_kw), 0);
const usable = el.pdu_kva_rated * el.pdu_power_factor * el.pdu_max_loading_pct / 100;
const n = el.pdu_per_hall_per_stream;
check('PDU2', num(el.pdu_kw_usable) && Math.abs(el.pdu_kw_usable - usable) < 0.05, 'pdu_kw_usable = kVA x pf x loading (' + el.pdu_kw_usable + ' vs ' + usable + ')');
check('PDU2', Number.isInteger(n) && n * usable >= itMax, 'n x usable >= hall IT (' + n + ' x ' + usable + ' vs ' + itMax + ')');
check('PDU2', Number.isInteger(n) && (n - 1) * usable < itMax, 'n is the smallest such count (' + n + ')');
check('PDU2', num(el.pdu_load_pct_contingency) && el.pdu_load_pct_contingency <= el.pdu_max_loading_pct + 0.05,
    'contingency loading ' + el.pdu_load_pct_contingency + ' % <= max ' + el.pdu_max_loading_pct + ' %');

/* PDU3 */
const big = halls.find((h) => h.it_design_kw === itMax) || {};
const normal = itMax / el.dist_tx_streams / (n * el.pdu_kva_rated * el.pdu_power_factor) * 100;
check('PDU3', num(el.pdu_load_pct_normal) && Math.abs(el.pdu_load_pct_normal - normal) < 0.06, 'normal loading ' + el.pdu_load_pct_normal + ' vs ' + normal.toFixed(2));
check('PDU3', Number.isInteger(el.rows_per_hall) && el.rows_per_hall * el.racks_per_row === big.racks,
    'rows ' + el.rows_per_hall + ' x ' + el.racks_per_row + ' = racks ' + big.racks);
const rpp = el.racks_per_pdu;
check('PDU3', Number.isInteger(rpp) && rpp * n >= big.racks && (rpp - 1) * n < big.racks, 'racks_per_pdu ' + rpp + ' covers ' + big.racks + ' racks on ' + n + ' PDUs');

/* PDU4 */
for (const k of ['pdu_kw_usable', 'pdu_per_hall_per_stream', 'pdu_load_pct_normal', 'pdu_load_pct_contingency', 'rows_per_hall', 'racks_per_pdu']) {
    const r = byId.get('electrical.' + k);
    check('PDU4', !!r && r.evidenceClass === 'DERIVED' && !!r.formulaExpr, k + ' registered DERIVED with formulaExpr');
}

if (fails.length) {
    console.log('FAIL Conventional PDU keys — ' + fails.length + ' of ' + (pass + fails.length));
    for (const f of fails) console.log('  ' + f);
    process.exit(1);
}
console.log('PASS Conventional PDU keys — ' + pass + ' checks (engine ' + calc.model.meta.version + ': ' + n + ' PDUs/stream/hall, ' +
    el.pdu_load_pct_normal + ' % normal, ' + el.pdu_load_pct_contingency + ' % one stream, ' + el.rows_per_hall + ' rows, ' + rpp + ' racks/PDU)');
