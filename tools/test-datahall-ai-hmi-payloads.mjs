#!/usr/bin/env node
/**
 * test-datahall-ai-hmi-payloads.mjs — the ONE source for every number an equipment HMI prints.
 *
 *   H1 every equipment class returns a frozen payload with the six tabs
 *   H2 every row with `basis` resolves in data/dcai-parameters.json and equals the registry value
 *      (the adapter's rounding is accepted at the printed precision); every row without `basis`
 *      carries a declared reason ≥ 40 characters; no NaN anywhere
 *   H3 determinism: the same tick → deepEqual payloads; tick+1 differs ONLY in simulated rows
 *   H4 states come from the scenario engines: 'ups_a_bypass' puts UPS-A on bypass with an alarm;
 *      'cdu-pump-fail' faults CDU pump 1; 'leak-z07' wets zone 7
 *   H5 the module sources contain no random call, and the page's HMI renderer ranges (between
 *      @rz-hmi:begin/@rz-hmi:end markers) contain none either — RED until Track A §A5 WP4 lands
 *   H6 fail-closed: a ctx without a snapshot throws in Node
 *
 * The page adapter (window.DHE) is built by an inline IIFE on datahallAI.html; this test runs that
 * IIFE in a vm sandbox on the real engine so the payload sees exactly what the browser sees.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const page = readFileSync(`${ROOT}/datahallAI.html`, 'utf8');
const engine = require(`${ROOT}/js/dcai-engine.js`);
const model = require(`${ROOT}/js/dcai-model.js`);
const Electrical = require(`${ROOT}/js/datahall-ai/electrical-topology.js`);
const Sim = require(`${ROOT}/js/datahall-ai/sim-telemetry.js`);
const Payloads = require(`${ROOT}/js/datahall-ai/hmi-payloads.js`);
const registry = JSON.parse(readFileSync(`${ROOT}/data/dcai-parameters.json`, 'utf8'));
const registryIndex = new Map(registry.parameters.map((p) => [p.id, p]));

/* the adapter IIFE and the DH_BASIS literal, straight from the page */
const adapterSrc = page.slice(page.indexOf('var DH=(function(){'), page.indexOf('var DHE=DH;'));
const basisMap = JSON.parse(page.match(/window\.DH_BASIS=(\{[\s\S]*?\});/)[1]);
function buildAdapter() {
    const sandbox = { window: null, console, Math, Number, String, Object, Array, isFinite, DCAI_MODEL: model, DCAI_CALC: engine };
    sandbox.window = sandbox; sandbox.globalThis = sandbox;
    sandbox.RZDatahallCurrentAuthority = () => ({ calc: engine, model: model.DCAI_MODEL || model, snapshot: engine.snapshot });
    vm.runInNewContext(adapterSrc + '\nwindow.__DH = DH;', sandbox, { filename: 'datahallAI-adapter.js' });
    return sandbox.__DH;
}
const adapter = buildAdapter();
assert.ok(adapter && typeof adapter.kwPerRack === 'number', 'the page adapter builds on the engine in Node');

function ctxFor(overrides = {}) {
    return {
        snapshot: engine.snapshot, adapter, basisMap, registryIndex, registryVersion: registry.engineVersion,
        scenario: Electrical.evaluateScenario(overrides.scenarioId || 'normal'),
        cooling: { scenarioId: overrides.coolingScenarioId || 'normal' },
        tick: overrides.tick ?? 4242, hall: overrides.hall || 1, sim: Sim, fire: overrides.fire || null,
    };
}
const SAMPLE_ID = { 'fire-output': 'ahu_crah', cdu: '4', chiller: '3', 'dry-cooler': '2', crah: '7', 'fire-zone': '1', 'fire-vesda': '2', 'net-spine': '0', 'net-leaf': '1', 'net-domain': '3', room: 'ups-a', 'fire-mcp': '1', 'bms-controller': '2' };
const idFor = (classId) => SAMPLE_ID[classId] || 'dh01';
const TABS = ['live', 'capacity', 'deps', 'alarms', 'trend', 'maint'];
const rowsOf = (p) => TABS.filter((t) => Array.isArray(p.tabs[t])).flatMap((t) => p.tabs[t]);

test('H1 every class returns a frozen payload with six tabs', () => {
    assert.ok(Payloads.CLASSES.length >= 40, `expected ≥ 40 classes, got ${Payloads.CLASSES.length}`);
    for (const c of Payloads.CLASSES) {
        const p = Payloads.payload(c.classId, idFor(c.classId), ctxFor());
        assert.equal(Object.isFrozen(p), true, `${c.classId} payload frozen`);
        for (const t of TABS) assert.ok(t in p.tabs, `${c.classId} has tab ${t}`);
        assert.ok(p.tabs.live.length >= 2, `${c.classId} live tab has rows`);
        assert.ok(p.title && p.statusChip && p.provenance, `${c.classId} carries title, chip, provenance`);
        assert.equal(typeof p.v, 'function');
        if (c.tier2 === null) assert.equal(p.actions.openHmi, null, `${c.classId} has no tier-2 opener`);
        else assert.ok(p.actions.openHmi && p.actions.openHmi.opener, `${c.classId} names its tier-2 opener`);
    }
});

test('H2 every row is hooked at parity or declared; no NaN', () => {
    let hooked = 0, declared = 0;
    for (const c of Payloads.CLASSES) {
        const p = Payloads.payload(c.classId, idFor(c.classId), ctxFor());
        for (const r of rowsOf(p)) {
            assert.ok(!(typeof r.value === 'number' && Number.isNaN(r.value)), `${c.classId}.${r.point} NaN`);
            assert.ok(!/NaN|undefined/.test(r.text), `${c.classId}.${r.point} text ${r.text}`);
            if (r.basis) {
                const rec = registryIndex.get(r.basis);
                assert.ok(rec, `${c.classId}.${r.point} basis ${r.basis} resolves`);
                assert.ok(!r.declared, `${c.classId}.${r.point} basis XOR declared`);
                if (typeof r.value === 'number' && typeof rec.value === 'number') {
                    /* the adapter rounds at the precision it prints; parity holds at that precision */
                    const decimals = (String(r.text).split('.')[1] || '').length;
                    assert.ok(Math.abs(r.value - rec.value) <= 0.5 * 10 ** -decimals + 1e-9, `${c.classId}.${r.point}=${r.value} vs ${r.basis}=${rec.value}`);
                }
                hooked++;
            } else {
                assert.ok(typeof r.declared === 'string' && r.declared.length >= 40, `${c.classId}.${r.point} declared ≥ 40 chars`);
                declared++;
            }
        }
        if (p.tabs.trend) assert.ok(p.tabs.trend.series.length >= 10 && p.tabs.trend.declared.length >= 40, `${c.classId} trend declared`);
    }
    console.log(`  rows hooked ${hooked} · declared ${declared}`);
    assert.ok(hooked > 100 && declared > 100);
});

test('H3 determinism per tick', () => {
    for (const c of Payloads.CLASSES) {
        const a = Payloads.payload(c.classId, idFor(c.classId), ctxFor({ tick: 777 }));
        const b = Payloads.payload(c.classId, idFor(c.classId), ctxFor({ tick: 777 }));
        assert.deepEqual(rowsOf(a).map((r) => r.text), rowsOf(b).map((r) => r.text), `${c.classId} identical at the same tick`);
        const n = Payloads.payload(c.classId, idFor(c.classId), ctxFor({ tick: 778 }));
        rowsOf(a).forEach((r, i) => { if (r.quality !== 'simulated') assert.equal(rowsOf(n)[i].text, r.text, `${c.classId}.${r.point} moved between ticks but is not simulated`); });
    }
});

test('H4 states come from the scenario engines', () => {
    const ups = Payloads.payload('sld-ups-a', 'dh01', ctxFor({ scenarioId: 'ups_a_bypass' }));
    assert.equal(ups.state('mode'), 'bypass'); assert.ok(ups.tabs.alarms.length >= 1 && ups.tabs.alarms[0].quality === 'simulated');
    const cdu = Payloads.payload('cdu', '4', ctxFor({ coolingScenarioId: 'cdu-pump-fail' }));
    assert.equal(cdu.state('pump_state_1'), 'fault'); assert.equal(cdu.state('pump_state_3'), 'run');
    const leak = Payloads.payload('leak', 'dh01', ctxFor({ coolingScenarioId: 'leak-z07' }));
    assert.equal(leak.state('zone_7'), 'wet'); assert.equal(leak.state('zone_8'), 'dry'); assert.equal(leak.statusChip.label, 'LEAK');
    const normal = Payloads.payload('leak', 'dh01', ctxFor());
    assert.ok(normal.tabs.live.every((r) => r.state !== 'wet'));
});

test('H5 no random call in the modules or the HMI renderer ranges', () => {
    for (const f of ['js/datahall-ai/sim-telemetry.js', 'js/datahall-ai/hmi-payloads.js']) {
        assert.doesNotMatch(readFileSync(`${ROOT}/${f}`, 'utf8'), /Math\.random\s*\(/, `${f} rolls no dice`);
    }
    const blocks = [...page.matchAll(/\/\* @rz-hmi:begin (\w+) \*\/([\s\S]*?)\/\* @rz-hmi:end \1 \*\//g)];
    assert.ok(blocks.length >= 22, `HMI renderers must be marker-delimited (found ${blocks.length}, need the 22 renderers + populateResults)`);
    for (const [, name, body] of blocks) {
        const rolls = (body.match(/Math\.random\s*\(|(?<![\w.])RI?\(/g) || []).length;
        assert.equal(rolls, 0, `${name} still rolls ${rolls} dice`);
    }
});

test('H6 fail-closed', () => {
    assert.throws(() => Payloads.payload('cdu', '1', { adapter, basisMap, registryIndex }), /snapshot/);
    const safe = Payloads.safePayload('cdu', '1', {});
    assert.equal(safe.unavailable, true);
    assert.throws(() => Payloads.payload('no-such-class', '1', ctxFor()), /unknown equipment class/);
});

test('H7 hall 12 is DH-12, never DH-012; a tray id keeps its tray number (audit 2026-11-16 C9, C5)', () => {
    const p = Payloads.safePayload('sld-msb', '1', ctxFor({ hall: 12 }));
    const text = JSON.stringify(p);
    assert.match(text, /DH-12/, 'the hall-12 payload names DH-12');
    assert.doesNotMatch(text, /DH-012|dh012/, 'no zero-prefixed two-digit hall');
    const one = JSON.stringify(Payloads.safePayload('sld-msb', '1', ctxFor({ hall: 1 })));
    assert.match(one, /DH-01/, 'hall 1 still reads DH-01');
    for (const [cls, id, want] of [['rack-ct', 'R07-CT-14', 14], ['rack-ct', '14', 14], ['rack-ns', 'R07-NS-3', 3], ['rack-ct', 'x', 1]]) {
        const t2 = JSON.stringify(Payloads.safePayload(cls, id, ctxFor()));
        assert.ok(t2.includes(`"${cls === 'rack-ct' ? 'ct' : 'ns'}",${want}]`), `${cls}:${id} opens tray ${want}`);
    }
});

test('H8 PRD-DCAI-HALL-DEPTH Amendment 8 (A8a): valves are the engine model, never a typed opening', () => {
    const rowsOf = (p) => { const out = []; (function walk(v) { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') { if (v.point) out.push(v); Object.values(v).forEach(walk); } })(p); return out; };
    const pick = (p, point) => rowsOf(p).find((r) => r.point === point);
    const cdu = pick(Payloads.payload('cdu', '1', ctxFor()), 'valve_pct');
    /* a telemetry point anchored on the engine model (+/- 0.3 % feedback), so a replayed BMS file can still override it */
    assert.ok(cdu && cdu.anchor === 'equipment.cdu_fws_valve_pct', `CDU valve_pct is anchored on the engine model (anchor ${cdu && cdu.anchor})`);
    assert.ok(Math.abs(cdu.value - engine.snapshot.equipment.cdu_fws_valve_pct) <= 0.3 + 1e-9 && cdu.value !== 70, `CDU valve ${cdu.value} within 0.3 of engine ${engine.snapshot.equipment.cdu_fws_valve_pct}`);
    const crah = pick(Payloads.payload('crah', '1', ctxFor()), 'valve_pct');
    assert.ok(crah && crah.anchor === 'equipment.crah_chw_valve_pct' && Math.abs(crah.value - engine.snapshot.equipment.crah_chw_valve_pct) <= 0.3 + 1e-9, `CRAH valve_pct anchored on the engine (${crah && crah.value}, ${crah && crah.anchor})`);
    assert.match(crah.declared, /crah_chw_valve_pct/, 'the declared reason names the engine model it is simulated about');
    const sb = pick(Payloads.payload('cdu', String(adapter.cduInstalled), ctxFor()), 'valve_pct');
    assert.ok(sb && sb.value === 0, `standby CDU valve is shut (${sb && sb.value})`);
});
